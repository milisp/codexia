import { isTauri } from '@tauri-apps/api/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { captureTokenFromFragment } from './stores/useWebAccessStore';
import './App.css';

// Before the first request: a `codexia-web pair` link carries the token.
if (!isTauri()) captureTokenFromFragment();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  React.createElement(React.StrictMode, null, React.createElement(App))
);
