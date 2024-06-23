/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: config => {
        // We append a new rules to the existing webpack config specifying that all files with a .woff2 extension should be treated as a static asset resources
        config.module.rules.push({
            test: /\.woff2$/,
            type: "asset/resource"
        })
        return config
    }
}

export default nextConfig