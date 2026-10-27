const usuarios = [
    { usuario: 'admin@gmail.com', clave: '123', rol: 'admin', nombre: 'admin MR' },
    { usuario: 'pepito@gmail.com', clave: '123', rol: 'asociado', nombre: 'Juan Perez' }
];

document.getElementById('formLogin').addEventListener('submit', function (event) {
    event.preventDefault();

    const usuarioInput = document.getElementById('Email').value;
    const claveInput = document.getElementById('Password').value;

    // Corrección: se usa 'usuarios' (con 's') y 'usuarioEncontrado'
    const usuarioEncontrado = usuarios.find(
        u => u.usuario === usuarioInput && u.clave === claveInput
    );

    if (usuarioEncontrado) {
        localStorage.setItem('logueado', 'true');
        localStorage.setItem('rol', usuarioEncontrado.rol);
        localStorage.setItem('nombre', usuarioEncontrado.nombre);
        window.location.href = 'dashboard.html';
    } else {
        alert('Usuario o contraseña incorrectos');
    }
});