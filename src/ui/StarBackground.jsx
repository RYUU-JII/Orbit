import React from "react";

export function StarBackground() {
  return (
    <>
      {[1, 2, 3, 4].map((layer) => (
        <div key={layer} className={`stars-layer stars-layer-${layer}`} aria-hidden="true">
          <div className="stars-track">
            <div className="stars-drift">
              <div className="stars-tile" />
              <div className="stars-tile" />
              <div className="stars-tile" />
              <div className="stars-tile" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}