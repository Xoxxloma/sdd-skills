package obs.config;

public class SecurityConfig {
    void configure(Http http) {
        http.authorizeHttpRequests(a -> a
            .requestMatchers("/admin/**").hasRole("ADMIN"));
    }
}
