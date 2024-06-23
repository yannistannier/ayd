from pydantic import BaseModel


class PipelineEvaluationMetrics(BaseModel):
    indice_performance_moteur_de_recherche: float
    indice_de_confiance: float
    qualite_reponse: float
    workflow: str
    collection: str
