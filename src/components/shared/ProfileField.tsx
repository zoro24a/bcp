import React from "react";

interface ProfileFieldProps {
  label: string;
  children: React.ReactNode;
}

const ProfileField = ({ label, children }: ProfileFieldProps) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <span className="text-base font-medium block">{children}</span>
  </div>
);

export default ProfileField;