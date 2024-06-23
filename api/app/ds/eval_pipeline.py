from typing import List, Any, Dict
from abc import ABC, abstractmethod
import time
import pandas as pd
import os
import numpy as np
import json
from app.config.logger import logger
import asyncio
from llama_index.core.evaluation import (
    CorrectnessEvaluator,
    FaithfulnessEvaluator,
    RelevancyEvaluator,
)
from fastapi import HTTPException, status
from llama_index.core.prompts import PromptTemplate
from tqdm import tqdm
from app.config.openai import client as openai_client, async_client as async_openai_client
from app.ds.rag_pipeline import NaiveRAGPipeline
import app.ds.ds_utils as ds_utils
from app.models.pipeline_evaluation_metrics import PipelineEvaluationMetrics
from app.config.mongo import client as mongo_client
from app.config.mlflow import client as mlflow_client
from app.utils.mlflow import log_rag_metrics
from app.config.prompts import prompts_config
from app.ds.rag_pipeline import RAGPipeline

class EvalRAGPipeline(ABC):
    """
    Abstract class for RAG pipeline
    """
    @abstractmethod
    async def eval_pipeline(self) -> Dict[str, float | str | int]:
        pass


def classifiy_pipeline_reponse(pipeline_reponse: List[str], embed_model : str , clf_pr) -> List[Any]:
    """This function classify RAG response in two categories :
    - It is a real response 
    - The model said that information is not in the context.

    Args:
        pipeline_reponse (List[str]): response from RAG pipeline
        embed_model (str): Embedding model used for classification
        clf_pr : response classifier model

    Returns:
        List : classification output
    """
    embeddings_pr =  ds_utils.compute_embedding(
        [str(response) for response in pipeline_reponse], model=embed_model
    )
    logger.info('Embedding computing finish')
    return clf_pr.predict(embeddings_pr)

def correctness_parsing(correctness_eval:str) -> float | int:
    """Parse grade from correctness evaluation output

    Args:
        correctness_eval (str): Output form LLM judge 

    Returns:
        (float | int): Correctness grade
    """
    possible_answer = ['1','2', '3','4','5']
    for p in possible_answer :
        if p in correctness_eval[:10] :
            return float(p)
    return 1

def evaluate_correctness(
    eval_question: List[str],
    eval_response: List[str],
    pipeline_response: List[str],
    model_name : str
) -> List[float | int]:
    """
    Correctness : (Supervised metric) Given a query and response, grade the LLM response

    Args:
        eval_question (List[str]): Set of evaluation queries
        eval_response (List[str]): Set of evaluation response to evaluation queries
        pipeline_response (List[str]): Set of RAG pipeline outputs to evaluation queries 
        model_name (str): judge model name to evaluate correctness

    Returns:
        List[float | int ]: Correctness evaluation output
    """
    eval_template = prompts_config['correctness']['eval'][model_name]['prompt']
    eval_prompts = [eval_template.format(query=eq, reference_answer=er,generated_answer=pr ) for eq,er,pr in zip(eval_question,eval_response,pipeline_response)]
    eval_completions = openai_client.completions.create(
            prompt=eval_prompts, model=model_name, temperature=0.0, max_tokens=2048
        )
    eval_res = [
        e.text.lower()
        for e in eval_completions.choices
    ]
    return [correctness_parsing(e) for e in eval_res]



def evaluate_faithfulness(
    pipeline_reponse: List[str],
    LLM_retriever_eval_output: List[str],
    judge_model_name : str,
    clf_pr,
    embed_model : str
) -> List[Any]:
    """This function evaluate faithfulness RAG pipeline
    - Faithfulness : (Unsupervised) Given a LLM response and sources, evaluate the level of hallucination into LLM response according to sources

    Args:
        pipeline_reponse (List[str]): RAG pipeline output
        LLM_retriever_eval_output (List[str]): output from the "llm_retriever_evaluation" function
        clf_pr : Classification model to check if the response is a "real" response or it detects an "anti" hallucination response
        embed_model (str) : Embedding model name used for classification
    Returns:
        List: Output from faithfull evaluation
    """
    faithfulness = []
    contexts = [ds_utils.node_parser(pr.source_nodes) for pr in pipeline_reponse]
    pipeline_reponse_classes = classifiy_pipeline_reponse(pipeline_reponse, embed_model, clf_pr)
    df = pd.DataFrame({"response_classif" : pipeline_reponse_classes,
                       "response": pipeline_reponse,
                       "context": contexts,
                       "LLM_retriever_eval_output": LLM_retriever_eval_output

    })
    if len(df[df["response_classif"] == 1]) > 0:
        faithfulness  += get_faithfulness(df.loc[df["response_classif"] == 1,"response"].to_list(),contexts=df.loc[df["response_classif" ] == 1,"context"].to_list(), model_name=judge_model_name)
    if len(df[df["response_classif"] == 0]) > 0:
        faithfulness += [0 if llm_r == 1 else 1 for llm_r in df.loc[df["response_classif"] == 0,"LLM_retriever_eval_output"].to_list()] 
    return np.mean(np.array(faithfulness))

def get_faithfulness(responses : str, contexts : str, model_name : str) -> List[str] :
    """Computes faithfulness thanks to LLM

    Args:
        responses (str): responses to evaluation queries answers
        contexts (str): retrieved contexts to evaluation queries
        model_name (str): judge model name 

    Returns:
        (List[str]): faithfulness output for each responses and contexts
    """  
    eval_template = prompts_config['faithfulness']['eval'][model_name]['prompt']
    eval_prompts = [eval_template.format(query_str = q, context_str = c) for q,c in zip(responses, contexts)]  
    eval_completions = openai_client.completions.create(
            prompt=eval_prompts, model=model_name, temperature=0.0, max_tokens=2048
        )
    eval_res = [
        e.text.lower()
        for e in eval_completions.choices
    ]
    return [1 if "yes" in e[:20] else 0 for e in eval_res]


def evaluate_retriever(eval_queries : List[str], response_eid : List[str], rag_pipeline, precision : int =5):
    """This function evaluate the search engine module of the RAG pipeline
    """
    correct_matches = []
    for i, query in tqdm(enumerate(eval_queries)):
        search_res = rag_pipeline.retrieve(query, precision)
        retriever_response_eid = [
            n.metadata["element_id"] for n in search_res
        ]

        # Check if the correct answer ID is among the top-5 re-ranked answers
        if response_eid[i] in retriever_response_eid[:precision]:
            correct_matches.append(1)
        else:
            correct_matches.append(0)

    return correct_matches


def llm_retriever_evaluator(eval_queries : List[str], rag_pipeline, precision : int, llm_checker_name : str) -> List[int]:
    """This function answers the question: "Is the information requested in the request in the response?

    Args:
        eval_queries (List[str]): Queries used for llm retrieval evaluation
        rag_pipeline :
        precision (int): number of document to retrieve
        llm_checker_name (str): _description_

    Returns:
        List(int): "Hit" scores
    """
    check_pt = prompts_config['retrieval_evaluation']['eval'][llm_checker_name]['prompt']
    prompts = []
    for query in eval_queries:
        sources_docs = ""
        search_res = rag_pipeline.retrieve(query, precision)
        for n in search_res:
            sources_docs += n.text + " /n/n "
        prompts.append(check_pt.format(query=query, context=sources_docs))
    check_completions = openai_client.completions.create(
            prompt=prompts, model=llm_checker_name, temperature=0.0, max_tokens=2048
        )
    check = [
        c.text.lower()
        for c in check_completions.choices
    ]
    return [1 if "yes" in c[:20] else 0 for c in check]


def generate_qa(texts : List[str], model_name : str) -> tuple[List[str], List[str]] :
    """This function generates Q&A from a piece of text using GenAI

    Args:
        texts (List[str]): List of text used for generation 
        model_name (str): GenAI model used for generation

    Returns:
        tuple[List[str], List[str]]:  Question and answers generated from text chunks
    """
    prompt_q = prompts_config['generation_eval']['generate_question'][model_name]['prompt']

    prompt_a = prompts_config['rag']['classique'][model_name]['prompt']
    inputs_q = [prompt_q.format(content=t) for t in texts]
    q_completions = openai_client.completions.create(
            prompt=inputs_q, model=model_name, temperature=0.0, top_p=0.01, max_tokens=2048
        )
    question = [
        q.text for q in q_completions.choices
    ]
    inputs_a = [
        prompt_a.format(context_str=t, query_str=q) for t, q in zip(texts, question)
    ]
    a_completions = openai_client.completions.create(
            prompt=inputs_a, model=model_name, temperature=0.0, max_tokens=4096
        )
    answer = [ 
        a.text
        for a in a_completions.choices
    ]
    return question, answer

class CaradocEvalPipeline(EvalRAGPipeline):
    """This class aims to create a class for default CARADOC eval pipeline
    """
    def __init__(self,
                 params: Dict[str, Any],
                ids: List[str],
                texts: List[str],
                generation_model: str,
                judge_model : str,
                embed_model : str,
                rag_pipeline : RAGPipeline, 
                clf_pr,
                precision: int = 5,
                collection_name: str = "demo") -> None:
        """
        Args:
            params (Dict[str, Any]): Set of params as "Workflow" of "Index" for logging
            ids (List[str]): Set of elements ids corresponding to chunk of documents 
            texts (List[str]): Set of texts for evaluation
            generation_model (str): model used for evaluation dataset generation
            judge_model (str): model used for evaluation
            embed_model (str): embedding model used for evaluation (into response classification)
            rag_pipeline (RAGPipeline): RAG pipeline defined in the application
            clf_pr : pipeline response classification model
            precision (int, optional): Number of document retrieve in the pipeline. Defaults to 5.
            collection_name (str, optional): Name of the Qdrant instance. Defaults to "demo".
        """

        self.params = params
        self.ids = ids
        self.texts = texts
        self.generation_model = generation_model
        self.judge_model = judge_model
        self.embed_model = embed_model
        self.rag_pipeline = rag_pipeline
        self.clf_pr = clf_pr
        self.precision = precision
        self.collection_name = collection_name

    def eval_pipeline(self) -> Dict[str, float]:
        """This function aims to evaluate a RAG pipeline on a given dataset on differents metrics :
        - Faithfulness -> "indice de confiance" : Pipeline ability to avoid hallucination
        - Correctness -> "qualité de réponse" : Pipeline ability to answer well to a query from a set of document's extracts
        - Retrieval score -> "indice performance moteur de recherche" : Metrics to evaluate the search engine of the pipeline
        
        Returns :
            Dict : A dictionnary with the three metrics for a RAG pipeline on a given dataset :
                - indice_performance_moteur_de_recherche
                - indice_de_confiance
                - qualite_reponse 
        """
        try:
            logger.info("Evaluation step 1 : Q&A generation")
            questions, answers = generate_qa(self.texts, self.generation_model)

            logger.info("Evaluation step 2 : Retrieval evaluation for top-precision")
            retriever_evaluation =  evaluate_retriever(
                eval_queries=questions,
                response_eid=self.ids,
                rag_pipeline=self.rag_pipeline,
                precision=self.precision,
            )
            llm_retriever_evaluation =  llm_retriever_evaluator(
                eval_queries=questions,
                rag_pipeline=self.rag_pipeline,
                precision=self.precision,
                llm_checker_name=self.judge_model,
            )

            logger.info("Evaluation step 3 : Generate RAG response")
            pipeline_rag_response = []
            for q in tqdm(questions):
                try:
                    resp =  self.rag_pipeline.query(q)
                    pipeline_rag_response.append(resp)
                except Exception as e:
                    logger.error(f"Error during response generation for query : {q} / {e}")
                    pipeline_rag_response.append(str(e))
            
            logger.info("Evaluation step 4 : Faithfulness evaluation")
            faithfulness_score =  evaluate_faithfulness(
                pipeline_reponse=pipeline_rag_response,
                judge_model_name=self.judge_model,
                LLM_retriever_eval_output=llm_retriever_evaluation,
                clf_pr=self.clf_pr,
                embed_model=self.embed_model,
            )

            logger.info("Evaluation step 5 : Corretness evaluation")
            correctness =  evaluate_correctness(
                eval_question=questions,
                eval_response=answers,
                pipeline_response=pipeline_rag_response,
                model_name=self.judge_model
            )

            correctness = [c for c in correctness if type(c) in [float, int]]
            logger.info("Evaluation step 6 : Postprocessing")
            retrieval_score = (
                np.mean(np.array(retriever_evaluation))
                + np.mean(np.array(llm_retriever_evaluation))
            ) / 2

            correctness_score = np.mean(np.array(correctness)) 
            if type(correctness_score) != float :
                correctness_score =  0
            run_name = f"{self.params['workflow']}_{self.params['index']}_{time.time()}"
            metrics = {
                "indice_performance_moteur_de_recherche": retrieval_score,
                "indice_de_confiance": faithfulness_score,
                "qualite_reponse": correctness_score / 5, # Normalize the score 
            }

            logger.info("Evaluation step 7 : Recording")
            log_rag_metrics(run_name, self.params, metrics)

            return metrics
        except Exception as e:
            logger.error(f"An error occurred while evaluating pipeline - Error message: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An error occurred while evaluating pipeline - Error message: {e}",
            )


