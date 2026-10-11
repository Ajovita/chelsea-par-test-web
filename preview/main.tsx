import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import ThemeProvider from '../components/theme-provider';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><Home/></ThemeProvider></React.StrictMode>);
