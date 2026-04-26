import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Sprout, Cpu, Users, LayoutGrid } from 'lucide-react';

const BottomNavigation = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navItems = [
        { name: 'Home',      path: '/dashboard',   icon: Home },
        { name: 'Farms',     path: '/farms',       icon: Sprout },
        { name: 'Ask Sakhi', path: '/assistant',   icon: Cpu, isCenter: true },
        { name: 'Community', path: '/community',   icon: Users },
        { name: 'More',      path: '/more',        icon: LayoutGrid },
    ];

    return (
        <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 px-6 py-3 pb-8 z-50">
            <div className="flex justify-between items-center relative">
                {navItems.map((item) => {
                    const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
                    const Icon = item.icon;

                    if (item.isCenter) {
                        return (
                            <Link key={item.name} to={item.path} className="relative -top-6 flex flex-col items-center">
                                <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 active:scale-95">
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-medium text-green-700 mt-1">{item.name}</span>
                            </Link>
                        );
                    }

                    return (
                        <Link key={item.name} to={item.path} className="flex flex-col items-center">
                            <Icon className={`w-6 h-6 mb-1 transition-colors ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className={`text-[10px] sm:text-xs font-medium transition-colors ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNavigation;
