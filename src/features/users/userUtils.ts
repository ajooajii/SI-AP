export const getStatusLabelAndStyles = (status: string) => {
  switch (status) {
    case 'pending':
      return { label: 'Menunggu Aktivasi', badge: 'pending' };
    case 'rejected':
      return { label: 'Ditolak', badge: 'rejected' };
    case 'inactive':
      return { label: 'Non-Aktif', badge: 'inactive' };
    case 'active':
    default:
      return { label: 'Aktif', badge: 'active' };
  }
};
