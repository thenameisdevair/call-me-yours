/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
                    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                ],
            },
        ];
    },
    webpack: (config) => {
        config.externals.push("pino-pretty", "lokijs", "encoding");
        return config;
    },
};

export default nextConfig;
