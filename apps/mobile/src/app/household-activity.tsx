import { HouseholdActivityFeed } from "@/features/activity/household-activity-feed";
import { useHouseholdAccess } from "@/features/onboarding/access";

export default function HouseholdActivityScreen() {
  const { listId } = useHouseholdAccess();
  return <HouseholdActivityFeed listId={listId} />;
}
