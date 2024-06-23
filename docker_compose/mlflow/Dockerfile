FROM python:3.10-slim
ENV HTTP_PROXY http://proxy.infra.dgfip:3128
ENV HTTPS_PROXY http://proxy.infra.dgfip:3128
COPY apt.conf /etc/apt/apt.conf

RUN apt-get update && apt-get install -y curl
RUN pip install mlflow[extras] psycopg2-binary boto3 cryptography pymysql

EXPOSE 5011
