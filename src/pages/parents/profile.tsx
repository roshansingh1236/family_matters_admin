import React from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import ParentProfileContent from '../../components/feature/profiles/ParentProfileContent';

const ParentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <ParentProfileContent id={id} />
      </div>
    </div>
  );
};

export default ParentProfilePage;
