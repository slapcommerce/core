import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

interface StackItem {
    title: string;
    content: React.ReactNode;
    key: string;
}

interface SheetStackContextType {
    push: (content: React.ReactNode, title: string) => void;
    pop: () => void;
    reset: () => void;
    depth: number;
}

const SheetStackContext = React.createContext<SheetStackContextType | null>(null);

export function useSheetStack() {
    const context = React.useContext(SheetStackContext);
    if (!context) {
        throw new Error("useSheetStack must be used within a SheetStackProvider");
    }
    return context;
}

interface SheetStackProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialContent: React.ReactNode;
    initialTitle: string;
}

export function SheetStack({
    open,
    onOpenChange,
    initialContent,
    initialTitle,
}: SheetStackProps) {
    const [stack, setStack] = React.useState<StackItem[]>([
        {
            title: initialTitle,
            content: initialContent,
            key: "initial",
        },
    ]);

    // Reset stack when sheet closes
    React.useEffect(() => {
        if (!open) {
            setStack([
                {
                    title: initialTitle,
                    content: initialContent,
                    key: "initial",
                },
            ]);
        }
    }, [open, initialContent, initialTitle]);

    // Update initial content when it changes
    React.useEffect(() => {
        if (stack.length === 1) {
            setStack([
                {
                    title: initialTitle,
                    content: initialContent,
                    key: "initial",
                },
            ]);
        }
    }, [initialContent, initialTitle, stack.length]); // Added stack.length to dependencies

    const push = React.useCallback((content: React.ReactNode, title: string) => {
        setStack((prev) => [
            ...prev,
            {
                title,
                content,
                key: `item-${Date.now()}-${Math.random()}`,
            },
        ]);
    }, []);

    const pop = React.useCallback(() => {
        setStack((prev) => {
            if (prev.length > 1) {
                return prev.slice(0, -1);
            }
            return prev;
        });
    }, []);

    const reset = React.useCallback(() => {
        setStack((prev) => {
            const first = prev[0];
            return first ? [first] : prev;
        });
    }, []);

    const currentItem = stack[stack.length - 1]!; // Added non-null assertion operator
    const depth = stack.length;

    const contextValue = React.useMemo(
        () => ({
            push,
            pop,
            reset,
            depth,
        }),
        [push, pop, reset, depth]
    );

    return (
        <SheetStackContext.Provider value={contextValue}>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto px-4"
                    side="right"
                >
                    <SheetHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            {depth > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={pop}
                                    className="gap-2 -ml-2"
                                >
                                    <IconArrowLeft className="size-4" />
                                    Back
                                </Button>
                            )}
                            <SheetTitle className="text-xl">{currentItem.title}</SheetTitle>
                        </div>
                    </SheetHeader>
                    <div key={currentItem.key}>{currentItem.content}</div>
                </SheetContent>
            </Sheet>
        </SheetStackContext.Provider>
    );
}
