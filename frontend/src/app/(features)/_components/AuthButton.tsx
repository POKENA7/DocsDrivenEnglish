import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function AuthButton() {
  return (
    <div className="text-sm">
      <SignedOut>
        <SignInButton mode="redirect">
          <button className="underline">login</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}
