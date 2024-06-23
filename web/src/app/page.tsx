"use client"

import { tss } from "tss-react/mui"
import { fr } from "@codegouvfr/react-dsfr"
import { Button } from "@codegouvfr/react-dsfr/Button"
import Image from 'next/image'
import { Card } from "@codegouvfr/react-dsfr/Card"
import { Tag } from "@codegouvfr/react-dsfr/Tag"
import { useRef } from "react";
// import DataVisualizationPictogram from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/digital/data-visualization.svg"
// import SearchPictogram from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/digital/search.svg"
// import CommunityPictogram from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/leisure/community.svg"
// import DocumentPictogram from "@codegouvfr/react-dsfr/dsfr/artwork/pictograms/document/document.svg"

const logosContainerSize = 270
const logoFeaturedSize = 100

// Each service of our app will be associated with a tag
// that will allow access to the service or simply showcase it without direct acces
const tagsData = {
    new: {
        tag: "Nouveau",
        actionText: "Accéder au service",
    },
    comingSoon: {
        tag: "À venir",
        actionText: "Bientôt disponible",
    }
}

type TagDataEntry = typeof tagsData

// We will highlight a selected set of services on the homepage
const highlightedServices = ['RAG-as-a-Service', 'Acculturation', 'Résumé']

// Each service of our app can be described by a few basic properties
const servicesData = [
    {
        title: "RAG-as-a-Service",
        description: "Découvrez une application de chat avancée qui vous permettra notamment de questionner des bases documentaires",
        path: "/caradoc/chat",
        imgSrc: "/logos/logo-caradoc-figure.png",
        imgAlt: "Logo Service Caradoc",
        tag: 'new',
        featuredLogoPosition: "left",
    },
    {
        title: "Acculturation",
        description: "Obtenez des connaissances de base pour appréhender la prise en main d’outils IA mais aussi mieux comprendre leur limites",
        // path: "/acculturation",
        imgSrc: "/logos/logo-training-figure.png",
        imgAlt: "Logo Service Formation",
        tag: 'comingSoon',
        featuredLogoPosition: "top",
    },
    {
        title: "Résumé",
        description: "Gagnez du temps en résumant des textes de longueur significatives grâce à l’IA",
        // path: "/summary",
        imgSrc: "/logos/logo-summary-figure.png",
        imgAlt: "Logo Service Résumé",
        tag: 'comingSoon',
        featuredLogoPosition: "bottom",
    },
    {
        title: "Traduction",
        description: "Traduisez des textes dans différentes langues grâce à l’IA",
        // path: "/summary",
        imgSrc: "/logos/logo-translation-figure.png",
        imgAlt: "Logo Service Résumé",
        tag: 'comingSoon',
        featuredLogoPosition: "right",
    },
]


export default function HomePage() {
    const {classes, cx} = useStyles()

    // This reference will help us scroll to the services card section
    const appServices = useRef<HTMLHeadingElement>(null)

    /**
     * Scroll to the services card section
     */
    const handleClickDiscoverServices = () => {
        if (appServices.current) {
            appServices.current.scrollIntoView({behavior: "smooth"})
        }
    }

    return (
        <div>
            {/* Highlight section */}
            <div className={cx('fr-container', classes.section, classes.featuredSection)}>

                {/* App general description */}
                <div className={classes.featuredDescription}>
                    <h1>Gen AI Platform by IT Group</h1>
                    <h3>Une suite applicative IA pour booster votre productivité: </h3>
                    <ul>
                        <li> LLM-as-a-Service</li>
                        <li> RAG-as-a-Service</li>
                    </ul>
                    <Button priority="primary"
                            title="Découvrir les services Connect IA"
                            iconPosition="right"
                            iconId="ri-settings-line"
                            onClick={handleClickDiscoverServices}>
                        Découvrir les services Connect IA
                    </Button>
                </div>

                {/* Featured logos */}
                <div className={classes.servicesLogosContainer}>
                    {
                        servicesData.map(service =>
                            <Image key={service.title}
                                   src={service.imgSrc}
                                   alt={service.imgAlt}
                                   width={logoFeaturedSize}
                                   height={logoFeaturedSize}
                                   className={cx(classes.absolutePosition, classes[service.featuredLogoPosition as keyof typeof classes])}/>
                        )
                    }
                </div>
            </div>

            {/* Services cards section */}
            <div className={cx(classes.section, classes.cardsContainer)}>
                <div className='fr-container'>
                    <h2 ref={appServices}>Les Services Connect IA</h2>
                    <div className={classes.cardContainer}>
                        {
                            servicesData
                                .filter(service => highlightedServices.includes(service.title))
                                .map(
                                    service =>
                                        <Card
                                            key={service.title}
                                            className={cx(classes.serviceCardContainer, service.tag === 'comingSoon' && classes.comingSoon)}
                                            background
                                            border
                                            desc={service.description}
                                            endDetail={tagsData[service.tag as keyof TagDataEntry].actionText}
                                            enlargeLink
                                            imageAlt={service.imgAlt}
                                            imageUrl={service.imgSrc}
                                            linkProps={{
                                                href: service.path || '#',
                                            }}
                                            start={<Tag small
                                                        className='fr-mb-2w'>{tagsData[service.tag as keyof TagDataEntry].tag}</Tag>}
                                            title={service.title}
                                            size="medium"
                                            titleAs="h5"
                                        />
                                )
                        }
                    </div>
                </div>

            </div>
        </div>
    )
}


const useStyles = tss.create(({theme}) => ({
    section: {
        ...fr.spacing('padding', {topBottom: '8w'}),
    },
    featuredSection: {
        display: "flex",
        flexDirection: 'column',
        gap: fr.spacing('2w'),
        ul: {
            marginBottom: fr.spacing('5w'),
        },
        [theme.breakpoints.up("md")]: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: fr.spacing('4w'),
        },
    },
    featuredDescription: {
        flex: 1,
    },
    servicesLogosContainer: {
        position: 'relative',
        width: logosContainerSize,
        height: logosContainerSize,
    },
    absolutePosition: {
        position: 'absolute',
    },
    top: {
        left: "50%",
        transform: "translateX(-50%)",
    },
    left: {
        top: "50%",
        transform: "translateY(-50%)",
    },
    right: {
        top: "50%",
        transform: "translateY(-50%)",
        right: 0,
    },
    bottom: {
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
    },
    cardsContainer: {
        backgroundColor: fr.colors.decisions.background.alt.grey.default,
    },
    cardContainer: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: fr.spacing('3w'),
        marginTop: fr.spacing('5w'),
        [theme.breakpoints.up("sm")]: {
            gridTemplateColumns: 'repeat(2, 1fr)',
        },
        [theme.breakpoints.up("md")]: {
            gridTemplateColumns: 'repeat(3, 1fr)',
        },
    },
    serviceCardContainer: {
        'div.fr-card__img': {
            display: 'flex',
            borderBottom: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
            img: {
                ...fr.spacing('margin', {topBottom: '2w', rightLeft: 'auto'}),
                aspectRatio: 'auto',
                maxWidth: 125,
            }
        }
    },
    comingSoon: {
        pointerEvents: "none",
    }
}))
