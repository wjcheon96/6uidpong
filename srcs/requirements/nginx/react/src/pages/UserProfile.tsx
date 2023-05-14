import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import useCallAPI from '../api';
import CircularImage from '../components/container/CircularImage';
import ContentBox from '../components/container/ContentBox';

export interface User {
  nickname: string;
  image: string;
  winStat: number;
  loseStat: number;
  ladderScore: number;
}

interface UserProfileProps {
  socket: Socket;
}

const UserProfile: React.FC<UserProfileProps> = ({ socket }) => {
  const callAPI = useCallAPI();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | undefined>(undefined);

  const handleDM = () => {
    const roomIdHandler = ({ roomId }: { roomId: string }) =>
      navigate(`/chat/${roomId}`, {
        state: { interlocutorId: userId },
      });
    socket.emit('join-dm', { userId }, roomIdHandler);
  };

  useEffect(() => {
    const fetchData = async () => {
      const data = await callAPI(`/api/v1/users/${userId}`);
      setUser(data);
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col items-center p-20">
      <ContentBox className="p-4">
        <h2 className="text-lg font-semibold">
          {user?.nickname ?? 'Loading...'}
        </h2>
        <CircularImage
          src={user?.image}
          alt="Profile"
          className="m-2.5 h-32 w-32"
        />
        <p className="mt-1 text-sm">Wins: {user?.winStat}</p>
        <p className="mt-1 text-sm">Losses: {user?.loseStat}</p>
        <p className="mt-1 text-sm">Ladder Score: {user?.ladderScore}</p>
        <div className="mt-4 flex">
          <button className="mr-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-400">
            Game
          </button>
          <button
            className="mr-2 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-400"
            onClick={handleDM}
          >
            DM
          </button>
          <button className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-400">
            Block
          </button>
        </div>
      </ContentBox>
    </div>
  );
};

export default UserProfile;
