@Repository
interface SiteRepository : JpaRepository<Site, String> {
    // адрес нормализуется фоновой джобой; у только что заведённого объекта поле пустое,
    // и по нему объект не находится сопоставлением
    @Query("select s from Site s where s.addressNormalized = :addr and s.addressNormalized is not null")
    fun byNormalizedAddress(addr: String): List<Site>
}
