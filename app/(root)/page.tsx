import { UserButton } from "@clerk/nextjs";
import React from "react";

const Homepages = () => {
  return (
    <div>
      <p>Homepages</p>
      <UserButton 
  appearance={{ 
    elements: { 
      userButtonPopoverCard: { pointerEvents: "initial" } 
    }, 
  }} 
  afterSignOutUrl="/" 
/>

    </div>
  );
};

export default Homepages;
