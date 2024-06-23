FROM python:3.10.13-slim

# This ensures that the python output is sent straight to terminal without being buffered (flushed immediately)
ENV PYTHONUNBUFFERED 1

# We disable bytecode generation for cleaner build
ENV PYTHONDONTWRITEBYTECODE 1

# We create a directory for the app
WORKDIR /app

# We set up the proxy


#COPY apt.conf /etc/apt/apt.conf

# We install necessary packages to compile / run our app
#RUN apk update && apk add --no-cache build-base libffi-dev
RUN apt-get update
RUN apt-get install gnupg -y  
RUN apt-get update && apt-get install ffmpeg libsm6 libxext6 pandoc enchant-2 myspell-fr-fr -y

# We copy the requirements file into the container
COPY requirements.txt .
#COPY pip.conf .
#ENV PIP_CONFIG_FILE=pip.conf

# We install the requirements
# --no-cache-dir is used to avoid caching the downloaded packages
# --upgrade option tells pip to upgrade the packages if they are already installed.
RUN pip install --no-cache-dir --upgrade -r requirements.txt
RUN pip install llama-index-embeddings-openai
# We copy the current directory into the container
COPY . .

# We start the application
#CMD ["uvicorn", "app.main:app", "--root-path", "/api", "--reload", "--host", "0.0.0.0", "--port" , "8100"]