// src/pages/_app.js
import '@/styles/globals.css';
import Layout from '../components/Layout';
import useAuth from '../hooks/useAuth';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const loading = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Checking authentication…
      </div>
    );
  }

  // if we're on /login, render the page without Layout/Navbar
  if (router.pathname === '/login' || router.pathname === '/signup') {
    return <Component {...pageProps} />;
  }

  // otherwise wrap in Layout
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
