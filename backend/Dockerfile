# use openjdk base image
from amazoncorretto:21

# set working directory
workdir /app/src

# copy the jar file
copy build/libs/backend-0.0.1-SNAPSHOT.jar app.jar

# run the application
entrypoint ["java", "-jar", "app.jar"]
