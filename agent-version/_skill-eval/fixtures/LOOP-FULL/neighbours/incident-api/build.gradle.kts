plugins {
    kotlin("jvm") version "1.9.24"
    id("org.springframework.boot") version "3.3.1"
}
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.postgresql:postgresql:42.7.3")
}
