"use client";

import type * as React from "react";
import { Home, Settings, User, HelpCircle, BookCopy } from "lucide-react";
import Link from "next/link";
import { useWebSocket } from "../context/WebSocketContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: BookCopy, label: "Tweets", href: "/tweet-page" },
  { icon: User, label: "Profile", href: "/" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: HelpCircle, label: "Help", href: "/help" },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { method } = useWebSocket();
  return (
    <Sidebar className='bg-black text-white border-card' {...props}>
      <SidebarHeader className='border-b border-black bg-black '></SidebarHeader>
      <SidebarContent className='bg-black border-card'>
        <SidebarGroup className='bg-black '>
          <SidebarGroupLabel className='text-gray-400 text-xl '>D3phcom</SidebarGroupLabel>
          <SidebarGroupLabel className='text-gray-400 text-sm '>{method}</SidebarGroupLabel>
          <SidebarGroupContent className='bg-black hover:bg-black'>
            <SidebarMenu className='mt-2'>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild className='hover:bg-black '>
                    <Link
                      href={item.href}
                      passHref
                      className='flex items-center gap-3 text-gray-400 hover:bg-black hover:text-white bg-black'>
                      <item.icon className='h-4 w-4' />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
