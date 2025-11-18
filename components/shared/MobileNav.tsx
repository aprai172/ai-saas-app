"use client";

import React from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { navLinks } from "@/constants";
import { Menu } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SignedOut, UserButton } from "@clerk/nextjs";

import { SignedIn } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
const MobileNav = () => {
  const pathname = usePathname();
  return (
    <header className="header">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/assets/images/logo-text.svg"
          alt="logo"
          width={180}
          height={24}
        />
      </Link>
      <nav className="flex gap-4">
        <SignedIn>
          <UserButton showName afterSignOutUrl="/" />
          <Sheet>
            <SheetTrigger>
              <Menu />
            </SheetTrigger>
            <SheetContent className="sheet-content sm:w-64 p-4">
              <>
                <Image
                  src="/assets/images/logo-text.svg"
                  alt="logo"
                  width={150}
                  height={23}
                />

                <ul className="header-nav_elements">
                  {navLinks.slice(0, 6).map((link) => {
                    const isActive = link.route === pathname;
                    return (
                      <li
                        key={link.route}
                        className={` ${isActive && "gradient-text"} p-18 flex whitespace-nowrap text-dark-700`}
                      >
                        <Link
                          href={link.route}
                          className="sidebar-link cursor-pointer"
                        >
                          <Image
                            src={link.icon}
                            alt={link.label}
                            width={20}
                            height={20}
                          />
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            </SheetContent>
          </Sheet>
        </SignedIn>

        <SignedOut>
          <Button asChild className="button bg-purple-gradient bg-cover">
            <Link href="/sign-in">login</Link>
          </Button>
        </SignedOut>
      </nav>
    </header>
  );
};

export default MobileNav;
