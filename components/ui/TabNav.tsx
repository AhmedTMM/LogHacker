'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CommandMenu } from './CommandMenu';
import { Plane, Users, Brain, Box, FolderOpen } from 'lucide-react';

const tabs = [
    { name: 'The Brain', href: '/', icon: Brain },
    { name: 'Flights', href: '/flights', icon: Plane },
    { name: 'Pilots', href: '/pilots', icon: Users },
    { name: 'Aircraft', href: '/aircraft', icon: Box },
    { name: 'Files', href: '/files', icon: FolderOpen },
];

export function TabNav() {
    const pathname = usePathname();

    return (
        <div className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
            <div className="flex h-16 items-center px-4 md:px-6">
                {/* Brand */}
                <div className="flex mr-8">
                    <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900">
                        <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center text-white">
                            <Plane className="h-4 w-4" />
                        </div>
                        <span className="hidden md:inline-block">LogHacker</span>
                    </Link>
                </div>

                {/* Navigation Tabs */}
                <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar mask-gradient md:space-x-2">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
                        const Icon = tab.icon;

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={cn(
                                    "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md whitespace-nowrap",
                                    isActive
                                        ? "text-blue-600 bg-blue-50/50"
                                        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                                {tab.name}
                                {isActive && (
                                    <span className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-600 rounded-t-full" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 md:gap-4">
                    <CommandMenu />
                    <div className="h-8 w-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-600">
                        CP
                    </div>
                </div>
            </div>
        </div>
    );
}
