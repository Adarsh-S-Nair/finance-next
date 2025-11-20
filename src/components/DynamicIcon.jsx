'use client';

import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';

// Map of loader functions to import libraries on demand
const libLoaders = {
  Fa: () => import('react-icons/fa'),
  Md: () => import('react-icons/md'),
  Gi: () => import('react-icons/gi'),
  Fi: () => import('react-icons/fi'),
  Io: () => import('react-icons/io'),
  Io5: () => import('react-icons/io5'),
  Ri: () => import('react-icons/ri'),
  Bs: () => import('react-icons/bs'),
  Bi: () => import('react-icons/bi'),
  Ai: () => import('react-icons/ai'),
  Tb: () => import('react-icons/tb'),
  Cg: () => import('react-icons/cg'),
  Hi: () => import('react-icons/hi'),
  Hi2: () => import('react-icons/hi2'),
  Pi: () => import('react-icons/pi'),
};

export default function DynamicIcon({ iconLib, iconName, className, fallback = FiIcons.FiTag, style }) {
  const [IconComponent, setIconComponent] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadIcon = async () => {
      // If no library or name, we'll use fallback
      if (!iconLib || !iconName) {
        if (isMounted) setIconComponent(null);
        return;
      }

      // Check if it's the fallback library (Fi) which we preload for efficiency or simpler imports
      // Optimization: If lib is Fi, we can use the static import if we wanted, but keeping consistent lazy loading is safer for memory
      // Actually, FiIcons is imported statically above for fallback use, so we can check that cache.
      if (iconLib === 'Fi' && FiIcons[iconName]) {
        if (isMounted) setIconComponent(() => FiIcons[iconName]);
        return;
      }

      const loader = libLoaders[iconLib];
      if (!loader) {
        console.warn(`DynamicIcon: Unknown library ${iconLib}`);
        if (isMounted) setIconComponent(null);
        return;
      }

      try {
        const module = await loader();
        const Icon = module[iconName];
        if (isMounted) {
          if (Icon) {
            setIconComponent(() => Icon);
          } else {
            // Icon not found in library
            setIconComponent(null);
          }
        }
      } catch (err) {
        console.error(`DynamicIcon: Failed to load icon ${iconLib}/${iconName}`, err);
        if (isMounted) setIconComponent(null);
      }
    };

    loadIcon();

    return () => {
      isMounted = false;
    };
  }, [iconLib, iconName]);

  const FallbackIcon = fallback;

  if (IconComponent) {
    return <IconComponent className={className} style={style} />;
  }

  return <FallbackIcon className={className} style={style} />;
}
