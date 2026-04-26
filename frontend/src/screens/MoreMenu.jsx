import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import {
    Clock, IndianRupee, Camera, User, Ticket, BookOpen,
    ChevronRight, Sprout, ShieldAlert, Bell
} from 'lucide-react';

const MoreMenu = () => {
    const { user } = useAuth();
    const [role, setRole] = useState('farmer');

    useEffect(() => {
        if (!user?.id) return;
        supabase
            .from('farmers')
            .select('role')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                if (data?.role) setRole(data.role);
            });
    }, [user?.id]);

    const menuItems = [
        {
            section: 'Farm Tools',
            items: [
                { label: 'Activity Logs', desc: 'Farm task timeline', icon: Clock,        path: '/activity',  color: 'bg-purple-50', iconColor: 'text-purple-600' },
                { label: 'Finance Tracker', desc: 'Expenses & income', icon: IndianRupee, path: '/finance',   color: 'bg-amber-50',  iconColor: 'text-amber-600'  },
                { label: 'Crop Scanner',  desc: 'Detect pests & diseases', icon: Camera,  path: '/camera',    color: 'bg-blue-50',   iconColor: 'text-blue-600'   },
            ],
        },
        {
            section: 'KVK & Support',
            items: [
                { label: 'Government Updates', desc: 'Schemes & news from KVK', icon: BookOpen, path: '/blog',    color: 'bg-teal-50',   iconColor: 'text-teal-600'   },
                { label: 'My Tickets',        desc: 'Support requests',         icon: Ticket,   path: '/tickets', color: 'bg-rose-50',   iconColor: 'text-rose-600'   },
                { label: 'Notifications',     desc: 'Alerts and nudges',        icon: Bell,     path: '/notifications', color: 'bg-indigo-50', iconColor: 'text-indigo-600' },
            ],
        },
        {
            section: 'Account',
            items: [
                { label: 'Profile', desc: 'Your details & settings', icon: User,   path: '/profile', color: 'bg-slate-50', iconColor: 'text-slate-600' },
            ],
        },
    ];

    if (role === 'admin') {
        menuItems.push({
            section: 'Administration',
            items: [
                { label: 'Admin Portal', desc: 'Manage system & users', icon: ShieldAlert, path: '/admin', color: 'bg-red-50', iconColor: 'text-red-600' },
            ]
        });
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-primary px-6 pt-10 pb-6 text-white shadow-md rounded-b-3xl">
                <p className="text-xs text-white/70 uppercase tracking-widest font-semibold mb-1">Navigation</p>
                <h1 className="text-2xl font-bold">More</h1>
            </header>

            <main className="p-5 space-y-6 -mt-2">
                {menuItems.map(({ section, items }) => (
                    <section key={section}>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">{section}</p>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                            {items.map(({ label, desc, icon: Icon, path, color, iconColor }) => (
                                <Link
                                    key={path}
                                    to={path}
                                    className="flex items-center gap-4 p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                >
                                    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <Icon className={`w-5 h-5 ${iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                                        <p className="text-xs text-slate-500 truncate">{desc}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </main>
        </div>
    );
};

export default MoreMenu;
