import { isAdmin } from '../../lib/studio';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Studio(){
 if(!await isAdmin())return <main className="admin-shell"><a href="/">← Back to Kold</a><h1>Studio access</h1><p>This dashboard is for the studio owner. Sign in with the authorised ChatGPT account.</p><p style={{marginTop:20}}><a className="text-link" target="_top" href="/signin-with-chatgpt?return_to=%2Fstudio">Sign in with ChatGPT ↗</a></p></main>;
 return <Dashboard/>;
}
