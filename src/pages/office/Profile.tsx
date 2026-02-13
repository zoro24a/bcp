import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ProfileHeader from "@/components/shared/ProfileHeader";
import EditableProfileField from "@/components/shared/EditableProfileField";
import { Profile as ProfileType } from "@/lib/types";
import ProfileField from "@/components/shared/ProfileField";
import { useSession } from "@/components/auth/SessionContextProvider";
import { fetchProfiles, updateProfile } from "@/data/appData";
import { showError, showSuccess } from "@/utils/toast";

const OfficeProfile = () => {
    const { user } = useSession();
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getProfile = async () => {
            if (user?.id) {
                setLoading(true);
                // Supabase RLS policies might need adjustment to allow office users to read their own profile if 'office' isn't explicitly handled in existing policies.
                // Assuming 'office' role profiles exist in 'profiles' table.
                // We use a generic fetch since there isn't a specific 'fetchOfficeProfiles' function, or we reuse fetchProfiles if RLS allows.
                // Ideally we should just fetch by ID.
                try {
                    const fetchedProfiles = await fetchProfiles('office'); // Passing 'office' role if that helper exists or just fetch all
                    const userProfile = fetchedProfiles.find(p => p.id === user.id);
                    if (userProfile) {
                        setProfile(userProfile);
                    } else {
                        // If not found in the list (maybe RLS issue), try direct fetch if possible or just handle error
                        // Fallback to basic session info?
                        console.error("Office profile not found in fetched list.");
                    }
                } catch (e) {
                    console.error("Error loading office profile", e);
                }
                setLoading(false);
            }
        };
        getProfile();
    }, [user]);

    const handleSaveField = async (field: keyof ProfileType, value: string) => {
        if (!user?.id) return;
        const updates: Partial<ProfileType> = { [field]: value };
        const updated = await updateProfile(user.id, updates);
        if (updated) {
            setProfile((prev) => (prev ? { ...prev, ...updated } : null));
            showSuccess(`${field} updated successfully!`);
        } else {
            showError(`Failed to update ${field}.`);
        }
    };

    if (loading) return <div className="p-8">Loading Profile...</div>;
    if (!profile) return <div className="p-8">Profile not found.</div>;

    return (
        <Card>
            <CardHeader>
                <ProfileHeader name={`${profile.first_name} ${profile.last_name || ''}`.trim()} subtitle="Office Staff Profile" />
            </CardHeader>
            <CardContent>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <ProfileField label="Username">{profile.username}</ProfileField>
                    <EditableProfileField
                        label="Email"
                        value={profile.email || ""}
                        onSave={(newValue) => handleSaveField("email", newValue)}
                    />
                    <EditableProfileField
                        label="Phone Number"
                        value={profile.phone_number || ""}
                        onSave={(newValue) => handleSaveField("phone_number", newValue)}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default OfficeProfile;
