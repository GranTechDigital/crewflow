import { useRouter } from 'next/navigation';
import { EyeIcon, StarIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface VersionSelectorProps {
  funcionarioId: string;
  currentVersion: 'original' | 'elegante' | 'moderno';
}

export default function VersionSelector({ funcionarioId, currentVersion }: VersionSelectorProps) {
  const router = useRouter();

  const versions = [
    {
      id: 'original',
      name: 'Original',
      description: 'Layout tradicional',
      icon: EyeIcon,
      path: `/prestserv/funcionario/${funcionarioId}`,
      color: 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
    },
    {
      id: 'elegante',
      name: 'Elegante',
      description: 'Design limpo e organizado',
      icon: SparklesIcon,
      path: `/prestserv/funcionario/${funcionarioId}/elegante`,
      color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100'
    },
    {
      id: 'moderno',
      name: 'Moderna',
      description: 'Interface moderna e profissional',
      icon: StarIcon,
      path: `/prestserv/funcionario/${funcionarioId}/moderno`,
      color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
    }
  ];

  return (
    <div className="flex items-center space-x-2">
      {versions.map((version) => (
        <button
          key={version.id}
          onClick={() => router.push(version.path)}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
            currentVersion === version.id 
              ? 'ring-2 ring-blue-500 ring-offset-2' 
              : version.color
          }`}
          title={version.description}
        >
          <version.icon className="w-4 h-4 mr-2" />
          {version.name}
        </button>
      ))}
    </div>
  );
} 