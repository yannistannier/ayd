# We choose a lightweight base image to run our application
FROM node:20

# We set the working directory to /app
WORKDIR /app

# We copy the package.json and package-lock.json files into the container
COPY package.json package-lock.json ./
#COPY .npmrc ./

# We install the dependencies
RUN npm install

# We copy the rest of the files into the container
COPY . .

# We start the application
CMD ["npm", "run", "dev"]