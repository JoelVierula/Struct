import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ListingPage from './pages/ListingPage';
import Calendar from './pages/Calendar';
import Login from './pages/Login';

export default function App() {
  const [items, setItems] = useState([]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home items={items} setItems={setItems} />} />
        <Route path="/listing/:id" element={<ListingPage />} />
        <Route path="/calendar" element={<Calendar />} />
      </Routes>
    </BrowserRouter>
  );
}