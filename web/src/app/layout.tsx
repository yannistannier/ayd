import { ReactNode } from "react"
import { DsfrHead } from "@codegouvfr/react-dsfr/next-appdir/DsfrHead"
import { DsfrProvider } from "@codegouvfr/react-dsfr/next-appdir/DsfrProvider"
import { getHtmlAttributes } from "@codegouvfr/react-dsfr/next-appdir/getHtmlAttributes"
import MuiDsfrThemeProvider from "@codegouvfr/react-dsfr/mui"
import { StartDsfr } from "./StartDsfr"
import { defaultColorScheme } from "./defaultColorScheme"
import { NextAppDirEmotionCacheProvider } from "tss-react/next/appDir"
import { TssCacheProvider } from "tss-react"
import MainContentLayout from "@/app/MainContentLayout"

export default function RootLayout({children}: { children: ReactNode }) {
    /**
     * Actually, the lang parameter is optional and defaults to "fr", but let set it explicitly
     */
    const lang = "fr"

    return (
        <html {...getHtmlAttributes({defaultColorScheme})} >

        {/* HTML page Header */}
        <head>
            <StartDsfr/>
            <DsfrHead
                doDisableFavicon={true} 
                // You can avoid having a flash of unstyled text by preloading the font variant used on your homepage
                preloadFonts={[
                    "Marianne-Regular",
                    "Marianne-Medium",
                    "Marianne-Bold",
                    "GreenEmeraude"
                ]}
            />
            <title>Ask Your Document Chat</title>
        </head>

        {/* HTML page Body */}
        <body>
        <NextAppDirEmotionCacheProvider options={{key: "mui"}}>
            <NextAppDirEmotionCacheProvider options={{key: "tss"}}
                                            CacheProvider={TssCacheProvider}>
                <DsfrProvider lang={lang}>
                    <MuiDsfrThemeProvider>
                        <MainContentLayout>
                            {children}
                        </MainContentLayout>
                    </MuiDsfrThemeProvider>
                </DsfrProvider>
            </NextAppDirEmotionCacheProvider>
        </NextAppDirEmotionCacheProvider>
        </body>

        </html>
    )
}