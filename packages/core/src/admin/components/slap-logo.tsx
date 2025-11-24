import { motion } from "framer-motion";

export function SlapLogo({ className }: { className?: string }) {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="size-full"
            >
                {/* Impact Spikes - Punk Orange */}
                <motion.g
                    initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: 1.6, rotate: 15 }}
                    transition={{
                        duration: 0.4,
                        delay: 0.3,
                        times: [0, 0.2, 1],
                    }}
                    className="text-punk-orange"
                >
                    <path
                        d="M12 2L13 5M12 22L11 19M2 12L5 11M22 12L19 13M4.9 4.9L7 7M19.1 19.1L17 17M4.9 19.1L7 17M19.1 4.9L17 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                </motion.g>

                {/* Clean, Defined Hand - Punk Red (Primary) */}
                <motion.g
                    initial={{
                        rotate: -60,
                        scale: 1.2,
                        x: -20,
                        y: -10,
                        opacity: 0
                    }}
                    animate={{
                        rotate: -5,
                        scale: 1,
                        x: 0,
                        y: 0,
                        opacity: 1
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 12,
                        mass: 0.5,
                        delay: 0.1
                    }}
                >
                    <path
                        d="M12 2C11.45 2 11 2.45 11 3V9H10V4C10 3.45 9.55 3 9 3C8.45 3 8 3.45 8 4V9H7V6C7 5.45 6.55 5 6 5C5.45 5 5 5.45 5 6V13.5C5 16.54 7.46 19 10.5 19H13.5C16.54 19 19 16.54 19 13.5V7C19 6.45 18.55 6 18 6C17.45 6 17 6.45 17 7V9H16V3C16 2.45 15.55 2 15 2C14.45 2 14 2.45 14 3V9H13V3C13 2.45 12.55 2 12 2Z"
                        fill="currentColor"
                        className="text-primary drop-shadow-md"
                    />
                    {/* Speed lines on the hand itself for impact */}
                    <motion.path
                        d="M10 5L10 2M14 5L14 2"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        className="text-primary-foreground opacity-30"
                    />
                </motion.g>
            </svg>
        </div>
    );
}
