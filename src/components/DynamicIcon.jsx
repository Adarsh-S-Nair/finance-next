import React from 'react';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import * as GiIcons from 'react-icons/gi';
import * as FiIcons from 'react-icons/fi';
import * as IoIcons from 'react-icons/io';
import * as Io5Icons from 'react-icons/io5';
import * as RiIcons from 'react-icons/ri';
import * as BsIcons from 'react-icons/bs';
import * as BiIcons from 'react-icons/bi';
import * as AiIcons from 'react-icons/ai';
import * as TbIcons from 'react-icons/tb';
import * as CgIcons from 'react-icons/cg';
import * as HiIcons from 'react-icons/hi';
import * as Hi2Icons from 'react-icons/hi2';
import * as PiIcons from 'react-icons/pi';

export const iconLibraries = {
  Fa: FaIcons,
  Md: MdIcons,
  Gi: GiIcons,
  Fi: FiIcons,
  Io: IoIcons,
  Io5: Io5Icons,
  Ri: RiIcons,
  Bs: BsIcons,
  Bi: BiIcons,
  Ai: AiIcons,
  Tb: TbIcons,
  Cg: CgIcons,
  Hi: HiIcons,
  Hi2: Hi2Icons,
  Pi: PiIcons,
};

export default function DynamicIcon({ iconLib, iconName, className, fallback = FiIcons.FiTag }) {
  // If no icon library or name is provided, use fallback
  if (!iconLib || !iconName) {
    const FallbackIcon = fallback;
    return <FallbackIcon className={className} />;
  }

  const IconComponent = iconLibraries[iconLib]?.[iconName];
  
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // If icon not found, use fallback
  const FallbackIcon = fallback;
  return <FallbackIcon className={className} />;
}
