import * as React from "react";

// Safe calculator that doesn't use eval()
function calculate(num1: number, operator: string, num2: number): number {
  switch (operator) {
    case "+":
      return num1 + num2;
    case "-":
      return num1 - num2;
    case "*":
    case "×":
      return num1 * num2;
    case "/":
    case "÷":
      return num1 / num2;
    default:
      return num2;
  }
}

export function Calculator() {
  const [display, setDisplay] = React.useState("5508");
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [previousValue, setPreviousValue] = React.useState<number | null>(null);
  const [operator, setOperator] = React.useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = React.useState(false);

  // Auto-flip on page load
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsFlipped(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleButtonClick = (value: string) => {
    if (value === "C") {
      setDisplay("0");
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(false);
    } else if (value === "=") {
      if (operator && previousValue !== null) {
        const currentValue = parseFloat(display);
        const result = calculate(previousValue, operator, currentValue);
        setDisplay(String(result));
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
      }
    } else if (["+", "-", "×", "÷"].includes(value)) {
      const currentValue = parseFloat(display);

      if (previousValue === null) {
        setPreviousValue(currentValue);
      } else if (operator) {
        const result = calculate(previousValue, operator, currentValue);
        setDisplay(String(result));
        setPreviousValue(result);
      }

      setOperator(value);
      setWaitingForOperand(true);
    } else {
      if (waitingForOperand) {
        setDisplay(value);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === "0" ? value : display + value);
      }
    }
  };

  const handleFlip = () => {
    // Reset to 5508 before flipping
    setDisplay("5508");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-8" style={{
      perspective: "1000px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "2rem",
      }}>
        {/* "Hello" text that appears to the left when flipped */}
        {isFlipped && (
          <div style={{
            fontFamily: "'Comic Sans MS', cursive",
            fontSize: "3rem",
            fontWeight: "bold",
            color: "var(--foreground)",
            animation: "fadeIn 0.5s ease-in 0.8s forwards",
            opacity: 0,
          }}>
            <style>
              {`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateX(-10px); }
                  to { opacity: 1; transform: translateX(0); }
                }
              `}
            </style>
            Hey
          </div>
        )}

        {/* Calculator and Flip Button Container */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
        }}>
          {/* Calculator Container with Flip Animation */}
          <div style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
            transform: isFlipped ? "rotateZ(180deg)" : "rotateZ(0deg)",
          }}>
          {/* Calculator Body */}
          <div style={{
            background: "linear-gradient(145deg, #2d3748, #1a202c)",
            borderRadius: "24px",
            padding: "2rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)",
            border: "2px solid #4a5568",
            width: "320px",
          }}>
            {/* Brand Label */}
            <div style={{
              textAlign: "center",
              marginBottom: "1rem",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.75rem",
              color: "#a0aec0",
              letterSpacing: "0.1em",
              fontWeight: "bold",
            }}>
            </div>

            {/* LCD Display */}
            <div style={{
              background: "linear-gradient(180deg, #c6ddb8 0%, #a8c89f 100%)",
              borderRadius: "8px",
              padding: "1.5rem 1rem",
              marginBottom: "1.5rem",
              boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.3)",
              border: "3px solid #2d3748",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* LCD Segments Effect */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px)",
                pointerEvents: "none",
              }} />

              {/* Display Text */}
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: "3rem",
                color: "#1a202c",
                textAlign: "right",
                fontWeight: "bold",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                letterSpacing: "0.05em",
                position: "relative",
                minHeight: "3.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
              }}>
                {display}
              </div>
            </div>

            {/* Calculator Buttons */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.75rem",
            }}>
              {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", "C", "=", "+"].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleButtonClick(btn)}
                  style={{
                    background: ["÷", "×", "-", "+"].includes(btn)
                      ? "linear-gradient(145deg, #f6ad55, #ed8936)"
                      : btn === "="
                      ? "linear-gradient(145deg, #48bb78, #38a169)"
                      : "linear-gradient(145deg, #4a5568, #2d3748)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    fontSize: "1.5rem",
                    fontFamily: "'Arial', sans-serif",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)",
                    transition: "all 0.1s ease",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "translateY(2px)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.2)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)";
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Flip Button */}
        <button
          onClick={handleFlip}
          style={{
            background: "linear-gradient(145deg, #fbbf24, #f59e0b)",
            color: "#1a202c",
            border: "none",
            borderRadius: "16px",
            padding: "1rem 2rem",
            fontSize: "1.25rem",
            fontFamily: "'Arial', sans-serif",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
            transition: "all 0.2s ease",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.95)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
          }}
        >
          {isFlipped ? "🔄 Flip Back" : "🔄 Flip It!"}
        </button>
        </div>
      </div>
    </div>
  );
}
