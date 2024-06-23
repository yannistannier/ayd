"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Header } from "@codegouvfr/react-dsfr/Header"
import { Footer } from "@codegouvfr/react-dsfr/Footer"
import type { MainNavigationProps } from "@codegouvfr/react-dsfr/src/MainNavigation"
import type { MenuProps } from "@codegouvfr/react-dsfr/src/MainNavigation/Menu"
import { headerFooterDisplayItem } from "@codegouvfr/react-dsfr/Display"
import { AlertProvider } from "@/app/shared/contexts/AlertContext"

import './styles.css';
// Each menu entry whether single or in a menu list will be extended with these properties
type ExtendedNavigationItem = {
    isActive?: boolean
    isFullHeight?: boolean
}

// We extend a menu of links
type CustomMenuItem = MainNavigationProps.Item.Menu & {
    isActive?: boolean
    isFullHeight?: boolean
    menuLinks: (MenuProps.Link & ExtendedNavigationItem)[]
}

// We extend single links
type CustomLinkItem = MainNavigationProps.Item.Link & ExtendedNavigationItem

// We create a union type that can host both single links and menu links
type NavigationEntry = CustomMenuItem | CustomLinkItem

// We construct our navigation entries
let navigation: NavigationEntry[] = [
    {
        linkProps: {
            href: '/',
        },
        text: 'Accueil',
    },
    {
        menuLinks: [
            {
                linkProps: {
                    href: '/caradoc/chat',
                },
                text: 'Chat',
                isFullHeight: true,
            },
            {
                linkProps: {
                    href: '/caradoc/collections',
                },
                text: 'Collections',
            },
        ],
        text: 'Caradoc'
    },
]

interface MainContentLayoutProps {
    children: ReactNode
}


/**
 * This layout wraps the application
 * Depending on the current route, it will or will now show the header or footer
 * @param children
 * @constructor
 */
export default function MainContentLayout({children}: MainContentLayoutProps) {
    // We'll need to know the current path to highlight the active navigation link
    const pathname = usePathname()

    // This variable will hold our current active entry
    let currentEntry: NavigationEntry = {} as NavigationEntry

    // We'll extend our navigation entries with a few useful properties
    // as well as set the current active entry
    let extendedNavigation = navigation.map((entry: NavigationEntry) => {
        // When encountering the home link, we'll show it as active only when the current route matches
        if (entry.linkProps?.href === '/') {
            entry.isActive = pathname === '/'
            entry.isActive && (currentEntry = entry)
        } else if (entry.menuLinks) {
            entry.menuLinks = entry.menuLinks.map(subEntry => {
                const isActive = pathname.startsWith(subEntry.linkProps.href!)
                // We by the way set the current active entry
                isActive && (currentEntry = subEntry)
                return {
                    ...subEntry,
                    isActive
                }
            })

            // The entire menu is considered active if any of its sub-links are active
            entry.isActive = entry.menuLinks.some(subEntry => subEntry.isActive)
        } else {
            entry.isActive = pathname.startsWith(entry.linkProps?.href!)
            entry.isActive && (currentEntry = entry)
        }
        return entry
    })

    return (
        <>
            {/* Header */}
            {
                !currentEntry.isFullHeight &&
                <Header brandTop=""
                        
                        homeLinkProps={{
                            href: '/',
                            title: 'Accueil IA Connect',
                        }}
                        id="app-header"
                        serviceTitle='IT Group'
                        serviceTagline=''
                        navigation={extendedNavigation as any}/>
            }

            {/* Main Content */}
            <AlertProvider>
                {children}
            </AlertProvider>


            {/* Footer */}
            {
                !currentEntry.isFullHeight &&
                <Footer
                    accessibility="partially compliant"
                    bottomItems={[
                        {
                            text: "Mentions légales",
                            linkProps: {
                                href: '#'
                            }
                        },
                        {
                            text: "Données personnelles",
                            linkProps: {
                                href: '#'
                            }
                        },
                        headerFooterDisplayItem
                    ]}
                    contentDescription="IT Group - Gen AI Platform"
                    domains={[]}
                    license="Tous droits réservés BNP"

                />
            }
        </>
    )
}