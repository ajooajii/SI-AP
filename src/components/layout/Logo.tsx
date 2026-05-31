import React, { useRef } from "react";
import { APP_NAME } from "../../constants";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className = "" }: LogoProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-24 h-24",
    xl: "w-32 h-32"
  };

  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <div className={`relative flex items-center justify-center ${sizes[size]} ${className}`}>
      {/* Primary Logo Image */}
      <img 
        src="/logo_siap.png" 
        alt={`${APP_NAME} Logo`} 
        className="w-full h-full object-contain relative z-10"
        referrerPolicy="no-referrer"
        onError={(e: any) => {
          // If image fails to load, hide it and show SVG fallback
          e.target.style.display = 'none';
          if (svgRef.current) {
            svgRef.current.style.display = 'block';
          }
        }}
      />

      {/* Modern SVG Fallback */}
      <svg 
        ref={svgRef}
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-full h-full drop-shadow-xl hidden"
      >
        <circle cx="50" cy="50" r="48" fill="white" />
        <circle cx="50" cy="50" r="42" stroke="#059669" strokeWidth="2" strokeDasharray="4 2" />
        
        {/* Stylized Truck Shape */}
        <path d="M25 60H35V45H75V65H25V60Z" fill="#059669" />
        <path d="M35 45L40 40H70L75 45H35Z" fill="#10B981" />
        <circle cx="35" cy="65" r="4" fill="#1e293b" />
        <circle cx="65" cy="65" r="4" fill="#1e293b" />
        
        {/* Environment Leaves */}
        <path d="M45 35C45 35 48 25 55 28C62 31 60 40 60 40C60 40 52 40 48 37C44 34 45 35 45 35Z" fill="#10B981" />
        <path d="M55 35C55 35 52 25 45 28C38 31 40 40 40 40C40 40 48 40 52 37C56 34 55 35 55 35Z" fill="#059669" />
        
        {/* Text Area */}
        <text x="50" y="85" textAnchor="middle" fill="#059669" fontSize="10" fontWeight="bold" className="font-sans">{APP_NAME}</text>
      </svg>
    </div>
  );
}
