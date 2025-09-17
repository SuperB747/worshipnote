import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, Search, Calendar, Plus } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Plus, label: '악보 추가', color: '#4a7c59' },
    { path: '/search', icon: Search, label: '악보 검색', color: '#6b8e6b' },
    { path: '/worship-list', icon: Calendar, label: '찬양 리스트', color: '#8b7355' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <Music className="logo-icon" />
          <span className="logo-text">WorshipNote</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{ '--item-color': item.color }}
            >
              <Icon className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <div className="app-version">v1.0.0</div>
      </div>
    </div>
  );
};

export default Sidebar;
