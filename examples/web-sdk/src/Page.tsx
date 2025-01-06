import { useAuth } from './MockAuthProvider.tsx';
import { useOpenFeature } from './OpenFeatureProvider.tsx';

function Page() {
  const { isLoading, user } = useAuth();

  const { client } = useOpenFeature();
  const isBetaEnabled = client.getBooleanValue('your-flag-key', false);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {isBetaEnabled ? (
        <div>
          <p>Hi {user?.name}, you're part of our beta program. 🎉</p>
          <p>Enjoy exploring this new feature.</p>
        </div>
      ) : (
        <div>
          <h1>Access Restricted</h1>
          <p>Hi {user?.name}, this feature is not available for you right now. 😢</p>
        </div>
      )}
    </>
  );
}

export default Page;
