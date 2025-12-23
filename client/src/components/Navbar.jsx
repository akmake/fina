import { useState, Fragment } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Menu, X, LogOut, LayoutDashboard, Wrench, FileText, User, Landmark,
  TrendingUp, Home, Settings, UserCircle, Briefcase, ChevronDown, Cpu 
} from "lucide-react"; // הוספנו את Cpu לאייקונים
import { motion, AnimatePresence } from "framer-motion";

// --- Imports from your project structure ---
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Navigation Structure ---
const navItems = [
    { to: '/', label: 'בית', icon: Home, type: 'link' },
    { to: '/finance-dashboard', label: 'דשבורד פיננסי', icon: LayoutDashboard, type: 'link', auth: true },
    { to: '/investments', label: 'ניהול השקעות', icon: TrendingUp, type: 'link', auth: true },
    { to: '/portfolio', label: 'דף עסקאות', icon: FileText, type: 'link', auth: true },
    { to: '/projects', label: 'פרויקטים', icon: Briefcase, type: 'link', auth: true },
    
    // --- הקישור החדש למרכז האוטומציה (לכל משתמש רשום) ---
    { to: '/management', label: 'אוטומציה', icon: Cpu, type: 'link', auth: true },
    
    { to: '/tzitzit', label: 'ציציות/טלית', icon: () => <span className="font-bold text-lg h-5 w-5 flex items-center justify-center">צ</span>, type: 'link', auth: true },
    { to: '/deposits', label: 'פיקדונות', icon: Landmark, type: 'link', auth: true },
    { to: '/funds', label: 'קרנות', icon: () => <span className="font-bold text-lg h-5 w-5 flex items-center justify-center">ק</span>, type: 'link', auth: true },

];

// --- Helper to filter links based on auth and role ---
const getVisibleItems = (isAuthenticated, user) => {
    return navItems.filter(item => {
        if (item.auth && !isAuthenticated) return false;
        // הסרנו את התנאי המחמיר לניהול, או השארנו אותו רק לפריטים שעדיין מוגדרים admin: true
        if (item.admin && user?.role !== 'admin') return false;
        return true;
    });
};

// --- Main Component ---
export default function Navbar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuthStore();
    const visibleItems = getVisibleItems(isAuthenticated, user);

    return (
        <>
            {/* --- Sidebar for Desktop --- */}
            <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
                <SidebarContent items={visibleItems} user={user} isAuthenticated={isAuthenticated} logout={logout} />
            </div>

            {/* --- Mobile Top Bar --- */}
            <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b h-16 px-4">
                 <Link to="/" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
                    yosefdahan
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            {/* --- Mobile Drawer --- */}
            <AnimatePresence>
                {sidebarOpen && (
                    <Fragment>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-40 bg-black/50 md:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                        {/* Drawer Content */}
                        <motion.div
                             initial={{ x: '100%' }}
                             animate={{ x: 0 }}
                             exit={{ x: '100%' }}
                             transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                             className="fixed inset-y-0 right-0 z-50 w-64 md:hidden"
                        >
                            <SidebarContent
                                items={visibleItems}
                                user={user}
                                isAuthenticated={isAuthenticated}
                                logout={logout}
                                onClose={() => setSidebarOpen(false)}
                            />
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>
        </>
    );
}

// --- Reusable Sidebar Content ---
function SidebarContent({ items, user, isAuthenticated, logout, onClose }) {
    const handleLogout = () => {
        logout();
        if (onClose) onClose();
    };

    return (
        <div className="flex flex-col flex-grow border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto h-full">
            <div className="flex items-center justify-between h-16 flex-shrink-0 px-4">
                <Link to="/" onClick={onClose} className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
                    yosefdahan
                </Link>
                {onClose && (
                     <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-6 w-6" />
                    </Button>
                )}
            </div>
            <div className="flex-1 flex flex-col">
                <nav className="flex-1 px-2 py-4 space-y-1">
                    {items.map((item) => (
                        <NavItem key={item.label} item={item} onClick={onClose} />
                    ))}
                </nav>
                <div className="px-2 py-4 border-t dark:border-slate-800">
                    {isAuthenticated ? (
                        <UserNav user={user} logout={handleLogout} />
                    ) : (
                        <div className="space-y-2">
                             <Button variant="ghost" asChild className="w-full justify-start">
                                <Link to="/login" onClick={onClose}><User className="ml-2 h-4 w-4" />התחברות</Link>
                            </Button>
                            <Button asChild className="w-full">
                                <Link to="/register" onClick={onClose}>הרשמה</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sidebar Navigation Item ---
function NavItem({ item, onClick }) {
    const navLinkClass = "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors";
    const activeClass = "bg-slate-100 dark:bg-slate-800 text-primary dark:text-white";
    const inactiveClass = "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-white";

    return (
        <NavLink
            to={item.to}
            onClick={onClick}
            className={({ isActive }) => `${navLinkClass} ${isActive ? activeClass : inactiveClass}`}
        >
            <item.icon className="ml-3 flex-shrink-0 h-5 w-5" />
            {item.label}
        </NavLink>
    );
}

// --- User Navigation (for Sidebar) ---
function UserNav({ user, logout }) {
     const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name[0].toUpperCase();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
                 <div className="flex items-center gap-3 text-sm font-medium p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                     <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        {getInitials(user?.name)}
                    </div>
                    <div className="text-start flex-1 truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.name || 'משתמש'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <ChevronDown size={16} className="text-slate-500" />
                 </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                    <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /><span>פרופיל</span></Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/settings"><Settings className="mr-2 h-4 w-4" /><span>הגדרות</span></Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>התנתק</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}