import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import ListingPage from './pages/ListingPage';
import Calendar from './pages/Calendar';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Page1 from './pages/page1';

export default function App() {
  const [items, setItems] = useState([]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/spreadsheet-alternative-for-mobile-tracking" element={<Page1 />} />
        <Route path="/home" element={<Home items={items} setItems={setItems} />} />
        <Route path="/listing/:id" element={<ListingPage />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}