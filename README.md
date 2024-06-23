# ask-your-document

Ce projet vise à développer une application RAG permettant à l'utilisateur de faire des requêtes en langages naturels avec ses propres documents et des bases de données partagées.

Par exemple, je reçois un document de plusieurs pages sur un projet. Caradoc sert à extraire rapidement les informations dont j'ai besoin via des requêtes comme :
- Quelle est l'objectif du projet ? 
- Peux-tu me donner les différents jalons du projet ? 
- Quelles sont les parties prenantes du projet ? 

Celle-ci est basée sur :
- le design system de l'état React DSFR pour la partie Frontend permettant aux différentes administrations d'implémenter la solution
- FastAPI pour le backend afin d'embarquer la solution la plus adapté pour les applications d'IA générative.

L'application est composée de deux modes de fonctionnements :
- Fichier : Ce mode permet de discuter poser des questions sur un ou plusieurs longs documents sans sauvegarde dans une base de données. 
- Collection : Ce mode permet l'utilisation de base de données plus complètes et partageable entre les utilisateurs. 


## Architecture technique

<p align="center">
    <img src=" doc/AYD_architecture.drawio.png"  width="100%">
</p>

## Déploiement

Afin d'avoir une interface de démo facilement déployable, l'application a été "packagée" dans un fichier docker compose. Celui-ci comprend :
- l'API
- l'interface web
- un serveur nginx
- un service redis 

Cependant pour que l'application fonctionne, des composants externes sont nécessaires :
- une base de données Qdrant 
- une base de données MongoDB
- un stockage objet Minio S3 (peut être proposer une option sans)
- un service d'API LLM sous format OpenAI 

### Configuration

Le fichier docker compose sert d'interface de paramètrage dans lequel on vient renseigner les variables d'environnement suivantes :
- OPENAI_API_BASE : URL serveur Openai 
- OPENAI_API_KEY : Clé API Openai
- QDRANT_ENDPOINT : URL Base de données Qdrant
- QDRANT_BASE_COLLECTION_NAME : Nom de la collection mère Qdrant 
- RAG_PRECISION : Nombre de documents retournés pour les appels RAG
- MINIO_ENDPOINT : URL stockage objet Minio
- MINIO_ACCESS_KEY : Clé d'accès stockage objet Minio
- MINIO_SECRET_KEY : Clé secrète stockage objet Minio
- MONGODB_URI : URI de la base mongo
- MONGO_DATABASE_NAME : Nom de la base de données pour intégrer les feedbacks utilisateurs 
- MONGO_USERNAME : Utilisateur mongo
- MONGO_PASSWORD : Mot de passe mongo
- MODELS : Dictionnaire contenant le nom des différents modèles pour les différentes tâches
- PROMPT_FILE_PATH : Chemin vers le fichier contenant les prompts de l'application.
- MLFLOW_URI : URI du service MLflow
- LOGGER_PATH : Chemin pour les fichiers de logs
- LOGGER_LEVEL : Niveau de logs 
 


### Fichier prompt.yaml

Ce fichier est un fichier permettant de gérer de manière exterieur les prompts liés à l'application. 

Il est structuré de la manière suivante :
```
[task]
    [subtask]
        [model]
            prompt :
            temperature :
            top_p :
            max_tokens :
            comment :

```

Ainsi, si vous implémenter un nouveau modèle pour une tâche particulière, il est possible de rajouter les nouveaux paramètres dans ce fichier et ainsi modifier le paramètre correspondant dans le fichier docker_compose. 

## Documentation technique 

### Pipeline disponible 

L'application utilise LlamaIndex pour la création de ses pipelines, cependant, une couche d'abstraction supplémentaire est offerte afin de permettre aux utilisateurs avancées de développer des pipelines innovants de la manière dont il le souhaite. Cela permet à l'application de ne pas dépendre complétement du framework initialement choisi.

Cette couche d'abstraction impose les méthodes suivantes :
- query (et sa version asynchrone aquery) : méthode pour faire des requête complète sur le pipeline RAG
- retrieve (et sa version asyncrhone aretrieve) : méthode pour récupérer les documents pertinents à partir d'une requête


#### 1. Pipeline RAG "Classique" 


<p align="center">
    <img src=" doc/Naive_RAG.png"  width="100%">
</p>
Ce dernier repose sur le princice du RAG (Retrieval Augmented Generation) issu du papier suivant : [INSERER LIEN PAPIER]

Cela permet d'avoir une utilisation simple de l'application 

#### 2. Pipeline RAG "Checker"

<p align="center">
    <img src=" doc/Check_RAG.png"  width="100%">
</p>

Dans ce cas, nous récupérons le pipeline initialement conçu avec l'ajout d'un contrôle de cohérence sur la sortie du retriever. Un LLM vérifie que dans les documents retournés, il existe les informations nécessaires à l'élaboration de la réponse.

### Ingestion des documents 

<p align="center">
    <img src=" doc/ingestion_data.png"  width="100%">
</p>
L'ingestion est séparé en deux parties :
- Ingestion du fichier brut
- Ingestion "vectorielle"

L'ingestion du fichier brut se fait dans un stockage objet minio permettant de garder les fichiers bruts nécessaires pour des fonctionnalités comme le téléchargement.

L'ingestion vectorielle est plus complexe puisqu'elle demande différents traitements.

#### 1. Le parsing 

La première étape consiste à récupérer les informations textuelles des documents. Ainsi, nous réalisons un traitement conditionnel en fonction du type de fichier.

Si le document est un PDF, nous le convertirons en premier lieu en fichier HTML à l'aide de PDFMiner, ce qui permet de garder la structure de celui-ci. Dans un second temps, un parsing est réalisé à l'aide du module Unstructured.

Pour les autres types de fichier supportés, le parsing est réalisé via le module Unstrucutred.

Ce dernier assure aussi le chunking à l'aide de la structure du fichier (à l'aide des titres notamment).

#### 2. Fiabilisation 

Lors de cette étape, l'objectif est de fiabilisé notre document si besoin. 

La condition de fiabilisation est régit par un filtre selon le pourcentage de mot directement disponible dans le dictionnaire. Si ce dernier est inférieur à un seuil défini dans la configuration de l'applicaiton, alors l'étape de fiabilisation est appliquée.

Cette étape consiste à utiliser un LLM pour fiabiliser le document et restructurer certaines parties. 

#### 3. Vectorisation et injection

A l'aide d'un modèle d'embedding, les chunks du document sont vectorisés et injecter dans une base de données vectorielles Qdrant.


### Evaluation du pipeline

<p align="center">
    <img src=" doc/eval_pipeline.drawio.png"  width="100%">
</p>

#### Principe 

Tout comme pour les pipelines de RAG, une couche d'abstraction a été imaginé afin de permettre aux contributeurs d'ajouter leur méthode d'évaluation en fonction de leur cas d'usage.

Cette abstraction comprend uniquement la méthode eval_pipeline. Cette fonction doit être utilisé uniquement par le endpoint evaluation/eval. 


#### Solution proposée

Cette fonctionnalité vise à fournir aux utilisateurs et administrateurs de l'application un framework d'évaluation des pipelines de RAG sur une base de données. 

Ce framework propose trois grandes métriques :
- Indice de performance du moteur de recherche : Cette métrique évalue la performance de la partie moteur de recherche 
- Indice de confiance : Cette métrique permet d'obtenir une métrique sur l'évaluation des modèles
- Qualité de réponse : Cette métrique supervisé vérifie si la méthode de RAG renvoie la bonne réponse à une question donnée

Toute ses métriques sont basés sur la méthode du LLM juge présentée dans le papier ci-contre [INSERER PAPIER]

De plus, le jeu d'évaluation est généré automatiquement à l'aide d'un LLM. Cela permet de pouvoir obtenir un jeu rapidement sur des bases de données utilisateurs spécifiques. En effet, chaque cas d'usages a des besoins différents qui peuvent être mieux répondu à l'aide de certain pipeline. 

NB : Bien que critiqué, elle est la seule méthode "sans labellisation" permettant d'évaluer les sorties des méthodes de RAG. Ainsi les métriques sont dépendantes des modèles LLM juges utilisés et peuvent comportés un bruit important. Il est donc recommandé d'utiliser le LLM le plus performant pour executer ce genre de tâche tout en respectant vos normes de sécurité et de confidentialité 

#### Indice de performance du moteur de recherche 

Cet indice est évalué en deux étapes :
- Evaluation classique :  Pour une requête associé à un document donné, nous évaluons la capacité du moteur de recherche à récupérer le document associé à la requête selon une precision k.
- Evaluation LLM : Pour une requête, nous évaluations la capacité du moteur de recherche à récupérer l'information permettant de répondre à la requête quelque soit le document. Ce mode d'évaluation permet de s'affranchir de l'indépendance d'une information dans un corpus de document. Une requête peut être répondu à l'aide d'un ou plusieurs documents. 

#### Indice de confiance

Cette indice est calculé en utilisant une méthode en plusieurs étapes :

En premier lieu, il faut pouvoir catégoriser notre message :
Pour pouvoir correctement répondre à la question : "Est-ce ma méthode de RAG à halluciner ?", il faut tout d'abord répondre à la question : "Est-ce que ma méthode RAG sait détecter quand l'information n'est pas présente dans le contexte ?".
En effet, en sortie, il peut y avoir deux types de réponses :
- Une réponse normal : Quelle est la taille de le Tour Eiffel ? La taille de la Tour Eiffel est 300m
- Un contrôle de réponse : Quelle est la taille de le Tour Eiffel ? Désolé, je n'ai pas d'informations dans le contexte fournie pour répondre à la question : Quelle est la taille de la Tour Eiffel. 

Ainsi, à l'aide d'un classifieur préalablement entraîné sur des données synthétiques, il est possible de classifier avec grandes précision les deux types de réponses.

Dans le cas d'une réponse normal, la seconde étape conciste à évaluer avec un LLM le degré d'hallucination de notre réponse. Dans l'autre cas, si l'information est présente dans le contexte alors notre méthode de RAG a halluciner, dans le cas contraire, elle a realisé un auto contrôle correct.

L'intérêt de cette méthode réside dans sa dissociation des cas pour écarter certains cas particuliers et fournir l'évaluation la plus pertinente possible. 


#### Qualité de réponse

Cet indice est evalué de manière "supervisé" : à partir de sa question et sa réponse associée, nous évaluons la pertinence de la réponse fournie par le pipeline par rapport à la question et réponse de référence.


## Auteurs
Hugo SIMON : Ingénieur de l'Industrie et des Mines spécialisé en Data science et sécurité informatique (simon.hugo59@orange.fr)
Mamadou Diallo : Développeur web full-stack
