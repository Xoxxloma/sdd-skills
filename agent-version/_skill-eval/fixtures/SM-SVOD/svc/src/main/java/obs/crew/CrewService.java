package obs.crew;

public class CrewService {
    public boolean canEdit(Member m) {
        return m.getRole() == MemberRole.CURATOR;
    }
}
