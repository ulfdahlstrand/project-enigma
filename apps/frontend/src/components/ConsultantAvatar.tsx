import Avatar from "@mui/material/Avatar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

interface ConsultantAvatarProps {
  name: string;
  profileImageDataUrl: string | null;
  size?: number;
  fontSize?: number;
}

export function ConsultantAvatar({
  name,
  profileImageDataUrl,
  size = 32,
  fontSize = 13,
}: ConsultantAvatarProps) {
  return (
    <Avatar
      alt={name}
      {...(profileImageDataUrl ? { src: profileImageDataUrl } : {})}
      sx={{
        width: size,
        height: size,
        fontSize,
        borderRadius: "50%",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </Avatar>
  );
}
