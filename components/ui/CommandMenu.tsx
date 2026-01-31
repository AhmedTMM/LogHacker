'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Plane, Users, Brain, Cloud, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function CommandMenu() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <Button
                variant="outline"
                className={cn(
                    "relative h-9 w-full justify-start rounded-[0.5rem] text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
                )}
                onClick={() => setOpen(true)}
            >
                <span className="hidden lg:inline-flex">Search...</span>
                <span className="inline-flex lg:hidden">Search...</span>
                <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
            <Command.Dialog
                open={open}
                onOpenChange={setOpen}
                label="Global Command Menu"
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-full bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden z-50 p-2"
            >
                <div className="flex items-center border-b border-zinc-100 px-3 pb-2" cmdk-input-wrapper="">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Command.Input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Type a command or search..."
                    />
                </div>
                <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden pt-2">
                    <Command.Empty className="py-6 text-center text-sm text-zinc-500">No results found.</Command.Empty>

                    <Command.Group heading="Navigation" className="text-zinc-500 text-xs font-medium px-2 py-1.5 mb-1 bg-zinc-50/50 rounded-md">
                        <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
                            <Brain className="mr-2 h-4 w-4" />
                            <span>The Brain</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/flights'))}>
                            <Plane className="mr-2 h-4 w-4" />
                            <span>Flights</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/pilots'))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Pilots</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/aircraft'))}>
                            <Plane className="mr-2 h-4 w-4" />
                            <span>Aircraft</span>
                        </CommandItem>
                    </Command.Group>

                    <Command.Group heading="Quick Actions" className="text-zinc-500 text-xs font-medium px-2 py-1.5 mb-1 bg-zinc-50/50 rounded-md">
                        <CommandItem onSelect={() => runCommand(() => console.log('Check Weather'))}>
                            <Cloud className="mr-2 h-4 w-4" />
                            <span>Check Weather...</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => console.log('New Flight'))}>
                            <Plane className="mr-2 h-4 w-4" />
                            <span>Add New Flight...</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => console.log('Upload Document'))}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Upload Document...</span>
                        </CommandItem>
                    </Command.Group>
                </Command.List>
            </Command.Dialog>
        </>
    );
}

function CommandItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
    return (
        <Command.Item
            onSelect={onSelect}
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 hover:bg-zinc-100 cursor-pointer text-zinc-700"
        >
            {children}
        </Command.Item>
    )
}
