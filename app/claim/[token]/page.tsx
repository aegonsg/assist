import { ClaimForm } from "@/app/components/Portal";

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClaimForm token={token} />;
}
