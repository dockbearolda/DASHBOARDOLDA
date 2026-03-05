import { redirect } from "next/navigation";

export default function Home() {
  // On commente la redirection pour que tu puisses voir le test
  // redirect("/dashboard");

  return (
    <div style={{ padding: '50px', fontSize: '24px' }}>
      <h1 style={{ color: 'red' }}>TEST CONNEXION REUSSI</h1>
    </div>
  );
}