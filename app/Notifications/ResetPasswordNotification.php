<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public function toMail($notifiable): MailMessage
    {
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Atur Ulang Password SIBIMA')
            ->greeting('Halo, '.$notifiable->name.'!')
            ->line('Kami menerima permintaan untuk mengatur ulang password akun SIBIMA Anda.')
            ->action('Atur Ulang Password', $this->resetUrl($notifiable))
            ->line("Tautan ini berlaku {$minutes} menit.")
            ->line('Jika Anda tidak meminta pengaturan ulang password, abaikan email ini; password Anda tidak berubah.')
            ->salutation('Salam, SIBIMA Kecamatan Sagulung');
    }
}
