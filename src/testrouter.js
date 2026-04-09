import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import ReactDOM from 'react-dom/client';

// --- Minimal Home page ---
function Home() {
  return (
    <div>
      <h1>Home Page</h1>
      <Link to="/item/0">Go to Item 0</Link>
    </div>
  );
}

// --- Minimal Item page ---
function Item() {
  const { id } = useParams();
  return <h1>Item Page {id}</h1>;
}

// --- Mount Router directly ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/item/:id" element={<Item />} />
    </Routes>
  </BrowserRouter>
);
