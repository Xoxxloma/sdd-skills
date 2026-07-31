@Component
class AuthClient(@Value("\${auth.base-url}") private val baseUrl: String) {
    fun rolesOf(userId: String) = http.get("$baseUrl/v1/users/$userId/roles")
}
